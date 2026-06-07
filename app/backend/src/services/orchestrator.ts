import { SessionContext } from './session-manager';
import { getAiAdapter } from './ai-client';
import { runCommand } from './command-runner';
import { writeFile, readFile, snapshotFile, deleteFile, scanDirectory } from './file-ops';
import { defaultLogger } from './logger';
import { ConversationTurn, TaskPlan, PermissionLevel } from '../types';
import path from 'path';

class Orchestrator {
  private session: SessionContext;

  constructor(session: SessionContext) {
    this.session = session;
  }

  /**
   * Generate AI plan and optionally execute it based on permission level.
   * When permission is 'default', only generate plan and wait for approval.
   * Returns { turn, pending } where pending=true means execution is deferred.
   */
  async executeTurn(userInput: string, permissionLevel?: PermissionLevel): Promise<{ turn: ConversationTurn; pending: boolean }> {
    const turn = this.session.addTurn(userInput);
    defaultLogger.info('executing_turn', {
      sessionId: this.session.session_id,
      turnNum: turn.turn_num,
      input: userInput.slice(0, 100),
      permissionLevel,
    });

    try {
      // Build context
      const context = await this.buildContext();

      // Generate AI plan
      const adapter = getAiAdapter();
      const plan = await adapter.generatePlan(userInput, context);
      turn.ai_plan = plan;

      const level = permissionLevel || 'default';

      // Check if execution requires approval
      const hasFileOps = plan.steps.some(s => s.type === 'file_edit' || s.type === 'delete');

      if (level === 'readonly') {
        // readonly: reject all file operations
        if (hasFileOps) {
          turn.errors.push('Permission denied: readonly mode does not allow file modifications.');
          turn.execution_results = { status: 'denied', reason: 'readonly' };
          return { turn, pending: false };
        }
        // Allow commands and conversational replies
        await this.executeSteps(plan, turn);
      } else if (level === 'full') {
        // full: auto-execute everything
        await this.executeSteps(plan, turn);
      } else {
        // default: require approval for file operations
        if (hasFileOps) {
          // Store pending plan, don't execute
          this.session.pending_plan = plan;
          turn.execution_results = { status: 'pending_approval', steps: plan.steps.map(s => ({
            description: s.description,
            type: s.type,
            files: s.files,
            command: s.command,
            danger_level: s.danger_level,
          }))};
          return { turn, pending: true };
        }
        // No file ops, execute directly (conversational reply)
        await this.executeSteps(plan, turn);
      }

      turn.execution_results = {
        status: 'success',
        modified_count: turn.modified_files.length,
      };

      defaultLogger.info('turn_completed', {
        sessionId: this.session.session_id,
        turnNum: turn.turn_num,
        modifiedFiles: turn.modified_files,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      let friendlyError = errorMsg;
      if (errorMsg.includes('402') || errorMsg.includes('Insufficient Balance')) {
        friendlyError = 'API Key 余额不足，请充值或更换 API Key。如需更换请在设置中修改。';
      } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Authentication')) {
        friendlyError = 'API Key 无效或已过期，请在设置中重新配置。';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        friendlyError = 'API 请求超时，请检查网络连接或稍后重试。';
      }
      turn.errors.push(friendlyError);
      turn.execution_results = { status: 'error', error: errorMsg };
      defaultLogger.error('turn_failed', {
        sessionId: this.session.session_id,
        turnNum: turn.turn_num,
        error: errorMsg,
      });
    }

    return { turn, pending: false };
  }

  /**
   * Execute a previously generated (pending) plan.
   */
  async executePendingPlan(): Promise<ConversationTurn | null> {
    const plan = this.session.pending_plan;
    if (!plan) return null;

    const lastTurn = this.session.getLastTurn();
    if (!lastTurn) return null;

    await this.executeSteps(plan, lastTurn);
    this.session.pending_plan = null;

    lastTurn.execution_results = {
      status: 'success',
      modified_count: lastTurn.modified_files.length,
    };

    return lastTurn;
  }

  private async executeSteps(plan: TaskPlan, turn: ConversationTurn): Promise<void> {
    for (const step of plan.steps) {
      if (step.type === 'file_edit') {
        await this.executeFileEdit(step, turn);
      } else if (step.type === 'command') {
        await this.executeCommand(step, turn);
      } else if (step.type === 'delete') {
        await this.executeDelete(step, turn);
      }
    }
  }

  private async buildContext(): Promise<Record<string, unknown>> {
    const projectDir = this.session.project_dir;
    const files = scanDirectory(projectDir);
    const fileContents: Record<string, string> = {};

    for (const filePath of files) {
      const content = readFile(path.join(projectDir, filePath));
      if (content !== null) {
        fileContents[filePath] = content;
      }
    }

    return {
      project_dir: projectDir,
      task_description: this.session.task_description,
      files: fileContents,
      file_count: Object.keys(fileContents).length,
      conversation_history: this.session.getConversationHistory(),
    };
  }

  private async executeFileEdit(step: Record<string, unknown>, turn: ConversationTurn): Promise<void> {
    const files = step.files as string[] | undefined;
    const content = step.content as string | undefined;
    if (!files || files.length === 0) return;

    for (const filePath of files) {
      const absPath = path.resolve(this.session.project_dir, filePath);
      snapshotFile(absPath);
      if (content !== undefined) {
        writeFile(absPath, content);
        turn.modified_files.push(filePath);
        defaultLogger.info('file_modified', { file: filePath, sessionId: this.session.session_id });
      }
    }
  }

  private async executeCommand(step: Record<string, unknown>, turn: ConversationTurn): Promise<void> {
    const cmd = step.command as string | undefined;
    if (!cmd) return;

    defaultLogger.info('executing_command', { command: cmd, sessionId: this.session.session_id });
    const result = await runCommand(cmd, 60000, this.session.project_dir);
    turn.execution_results = {
      ...turn.execution_results as Record<string, unknown>,
      last_command: cmd,
      stdout: result.stdout.slice(0, 1000),
      stderr: result.stderr.slice(0, 500),
      exit_code: result.exitCode,
    };

    if (result.exitCode !== 0) {
      turn.errors.push(`Command failed (exit ${result.exitCode}): ${result.stderr.slice(0, 200)}`);
    }
  }

  private async executeDelete(step: Record<string, unknown>, turn: ConversationTurn): Promise<void> {
    const files = step.files as string[] | undefined;
    if (!files) return;

    for (const filePath of files) {
      const absPath = path.resolve(this.session.project_dir, filePath);
      snapshotFile(absPath);
      deleteFile(absPath);
      turn.deleted_files.push(filePath);
      turn.modified_files.push(filePath);
      defaultLogger.info('file_deleted', { file: filePath, sessionId: this.session.session_id });
    }
  }
}

export { Orchestrator };