import { SessionContext } from './session-manager';
import { getAiAdapter } from './ai-client';
import { runCommand } from './command-runner';
import { writeFile, readFile, snapshotFile, deleteFile, scanDirectory } from './file-ops';
import { defaultLogger } from './logger';
import { ConversationTurn, TaskPlan } from '../types';
import path from 'path';

class Orchestrator {
  private session: SessionContext;

  constructor(session: SessionContext) {
    this.session = session;
  }

  async executeTurn(userInput: string): Promise<ConversationTurn> {
    const turn = this.session.addTurn(userInput);
    defaultLogger.info('executing_turn', {
      sessionId: this.session.session_id,
      turnNum: turn.turn_num,
      input: userInput.slice(0, 100),
    });

    try {
      // Build context from project files and conversation history
      const context = await this.buildContext();

      // Generate AI plan
      const adapter = getAiAdapter();
      const plan = await adapter.generatePlan(userInput, context);
      turn.ai_plan = plan;

      // Execute plan steps
      for (const step of plan.steps) {
        if (step.type === 'file_edit') {
          await this.executeFileEdit(step, turn);
        } else if (step.type === 'command') {
          await this.executeCommand(step, turn);
        } else if (step.type === 'delete') {
          await this.executeDelete(step, turn);
        }
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
      turn.errors.push(errorMsg);
      turn.execution_results = { status: 'error', error: errorMsg };
      defaultLogger.error('turn_failed', {
        sessionId: this.session.session_id,
        turnNum: turn.turn_num,
        error: errorMsg,
      });
    }

    return turn;
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
      // Create snapshot before modifying
      snapshotFile(absPath);
      // Write content
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