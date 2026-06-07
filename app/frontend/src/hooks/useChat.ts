import { useState, useCallback } from 'react';
import { sendMessage, getSessionDetails, approvePlan } from '../api/client';
import { ConversationMessage } from '../types';

// ... (getT function stays the same)

function getT(): (key: string, vars?: Record<string, string | number>) => string {
  try {
    const saved = localStorage.getItem('app_lang');
    const lang = saved === 'en' || saved === 'zh' ? saved : 'zh';
    const zh: Record<string, string> = {
      structuredPlan: '执行计划',
      structuredModifiedFiles: '修改的文件',
      structuredExecutionResults: '执行结果',
      structuredErrors: '错误',
      structuredCompleted: '已完成（无详情）',
      structuredError: '错误',
      structuredStatus: '状态：',
      structuredRequestFailed: '请求失败',
      welcomeContinueHint: '正在继续会话',
    };
    const en: Record<string, string> = {
      structuredPlan: 'Execution Plan',
      structuredModifiedFiles: 'Modified Files',
      structuredExecutionResults: 'Execution Results',
      structuredErrors: 'Errors',
      structuredCompleted: 'Completed (no details)',
      structuredError: 'Error',
      structuredStatus: 'Status: ',
      structuredRequestFailed: 'Request failed',
      welcomeContinueHint: 'Continuing session',
    };
    const dict = lang === 'en' ? en : zh;
    return (key: string, vars?: Record<string, string | number>) => {
      let text = dict[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    };
  } catch {
    return (key: string) => key;
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingSteps, setPendingSteps] = useState<Array<Record<string, unknown>> | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [activeSession, setActiveSessionState] = useState<{
    session_id: string;
    task_description: string;
    project_dir: string;
    turns?: number;
  } | null>(null);

  const setActiveSession = useCallback((session: typeof activeSession) => {
    setActiveSessionState(session);
    setPendingSteps(null);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeSession || !text.trim()) return;

    const t = getT();

    const userMsg: ConversationMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      turn_num: 0,
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await sendMessage(activeSession.session_id, text);

      if (result.status === 'pending_approval' && result.turn) {
        // Show AI's plan and ask for approval
        const steps = result.turn.execution_results?.steps || result.turn.ai_plan?.steps || [];
        setPendingSteps(steps);

        const aiResponse = result.turn.ai_plan?.response || '';
        const planText = steps.map((s: { description?: string }, i: number) =>
          `${i + 1}. ${s.description || JSON.stringify(s)}`
        ).join('\n');

        const content = aiResponse
          ? `${aiResponse}\n\n---\n**⏳ ${t('structuredPlan')}**\n${planText}`
          : `**⏳ ${t('structuredPlan')}**\n${planText}`;

        setMessages(prev => [...prev, {
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
          turn_num: result.turn.turn_num,
        }]);
      } else if (result.status === 'completed' && result.turn) {
        const turn = result.turn;
        const aiContent: string[] = [];

        const aiResponse = turn.ai_plan?.response || '';
        const hasSteps = turn.ai_plan?.steps && turn.ai_plan.steps.length > 0;
        const hasFiles = turn.modified_files && turn.modified_files.length > 0;
        const hasErrors = turn.errors && turn.errors.length > 0;
        const hasResult = turn.execution_results && turn.execution_results.status;

        if (aiResponse) aiContent.push(aiResponse);

        if (hasSteps) {
          const stepDescriptions = turn.ai_plan.steps
            .map((s: { description?: string }, i: number) => `${i + 1}. ${s.description || JSON.stringify(s)}`)
            .join('\n');
          aiContent.push(`\n---\n**${t('structuredPlan')}**\n${stepDescriptions}`);

          if (hasFiles) {
            aiContent.push(`\n**${t('structuredModifiedFiles')}**`);
            turn.modified_files.forEach((f: string) => aiContent.push('- `' + f + '`'));
          }

          if (hasResult) {
            const execResult = turn.execution_results;
            if (execResult.status === 'success') {
              aiContent.push(`\n✅ ${t('structuredCompleted')}`);
              if (execResult.stdout) {
                aiContent.push('```\n' + String(execResult.stdout).slice(0, 500) + '\n```');
              }
            } else if (execResult.status === 'error') {
              aiContent.push(`\n❌ ${t('structuredError')}: ${execResult.error || ''}`);
            }
          }
        }

        if (hasErrors && !hasSteps) {
          aiContent.push(`\n---\n**${t('structuredErrors')}**`);
          turn.errors.forEach((e: string) => aiContent.push('- ' + e));
        }

        if (aiContent.length === 0) aiContent.push(t('structuredCompleted'));

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: aiContent.join('\n'),
          timestamp: new Date().toISOString(),
          turn_num: turn.turn_num,
        }]);

        try {
          const details = await getSessionDetails(activeSession.session_id);
          setActiveSessionState(prev => prev ? { ...prev, turns: details.turns } : null);
        } catch { /* ignore */ }
      } else if (result.status === 'error') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '**' + t('structuredError') + '**: ' + (result.errors || []).join('\n'),
          timestamp: new Date().toISOString(), turn_num: 0,
        }]);
      } else if (result.status === 'busy') {
        setMessages(prev => [...prev, {
          role: 'assistant', content: result.message,
          timestamp: new Date().toISOString(), turn_num: 0,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: t('structuredStatus') + result.status,
          timestamp: new Date().toISOString(), turn_num: 0,
        }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请求失败';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ ' + msg,
        timestamp: new Date().toISOString(), turn_num: 0,
      }]);
    }

    setLoading(false);
  }, [activeSession]);

  const handleApprove = useCallback(async () => {
    if (!activeSession) return;
    setApprovalLoading(true);
    try {
      const result = await approvePlan(activeSession.session_id);
      setPendingSteps(null);

      if (result.status === 'completed' && result.turn) {
        const turn = result.turn;
        const t = getT();
        const aiContent: string[] = [];

        if (turn.modified_files && turn.modified_files.length > 0) {
          aiContent.push(`✅ **${t('structuredModifiedFiles')}**`);
          turn.modified_files.forEach((f: string) => aiContent.push('- `' + f + '`'));
        }
        if (turn.errors.length > 0) {
          aiContent.push(`\n❌ **${t('structuredErrors')}**`);
          turn.errors.forEach((e: string) => aiContent.push('- ' + e));
        }
        if (aiContent.length === 0) aiContent.push('✅ ' + t('structuredCompleted'));

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: aiContent.join('\n'),
          timestamp: new Date().toISOString(),
          turn_num: turn.turn_num,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '**Error**: ' + (result.errors || []).join('\n'),
          timestamp: new Date().toISOString(), turn_num: 0,
        }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '**Error**: ' + msg,
        timestamp: new Date().toISOString(), turn_num: 0,
      }]);
    }
    setApprovalLoading(false);
  }, [activeSession]);

  const handleReject = useCallback(() => {
    setPendingSteps(null);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '❌ 操作已取消',
      timestamp: new Date().toISOString(),
      turn_num: 0,
    }]);
  }, []);

  const setInitialMessages = useCallback((msgs: ConversationMessage[]) => {
    setMessages(msgs);
    setPendingSteps(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingSteps(null);
  }, []);

  return {
    messages,
    loading,
    pendingSteps,
    approvalLoading,
    activeSession,
    setActiveSession,
    sendMessage: handleSendMessage,
    approveAction: handleApprove,
    rejectAction: handleReject,
    setInitialMessages,
    clearMessages,
  };
}
