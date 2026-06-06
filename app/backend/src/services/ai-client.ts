import axios from 'axios';
import {
  DYNAMIC_PROVIDER, USE_MOCK_CLAUDE,
  DYNAMIC_DEEPSEEK_KEY, DYNAMIC_DEEPSEEK_URL, DYNAMIC_DEEPSEEK_MODEL,
  DYNAMIC_CLAUDE_KEY, DYNAMIC_CLAUDE_URL, DYNAMIC_CLAUDE_MODEL,
} from '../config';
import { TaskPlan } from '../types';
import { defaultLogger } from './logger';

interface AiAdapter {
  generatePlan(naturalLanguage: string, context?: Record<string, unknown>): Promise<TaskPlan>;
}

// �w�w�w Mock Adapter �w�w�w

class MockAdapter implements AiAdapter {
  async generatePlan(naturalLanguage: string, _context?: Record<string, unknown>): Promise<TaskPlan> {
    const nl = naturalLanguage.trim().toLowerCase();
    const steps = [];

    if (nl.includes('create') || nl.includes('add') || nl.includes('new')) {
      steps.push({
        description: `Create a new file based on: ${naturalLanguage.slice(0, 60)}`,
        type: 'file_edit',
        files: ['example.ts'],
        content: `// Generated based on: ${naturalLanguage}\nconsole.log("hello");\n`,
        danger_level: 0,
      });
    } else if (nl.includes('modify') || nl.includes('change') || nl.includes('update')) {
      steps.push({
        description: `Modify existing file: ${naturalLanguage.slice(0, 60)}`,
        type: 'file_edit',
        files: ['existing.ts'],
        content: `// Modified: ${naturalLanguage}\nconsole.log("updated");\n`,
        danger_level: 1,
      });
    } else if (nl.includes('delete') || nl.includes('remove')) {
      steps.push({
        description: `Delete file based on: ${naturalLanguage.slice(0, 60)}`,
        type: 'file_edit',
        operation: 'delete',
        files: ['file_to_delete.ts'],
        content: null,
        danger_level: 2,
      });
    } else if (nl.includes('run') || nl.includes('install') || nl.includes('test')) {
      steps.push({
        description: `Run command: ${naturalLanguage}`,
        type: 'command',
        command: nl.includes('install') ? 'npm install' : 'echo "Running..."',
        danger_level: 1,
      });
    } else {
      steps.push({
        description: `Process request: ${naturalLanguage.slice(0, 80)}`,
        type: 'file_edit',
        files: ['output.txt'],
        content: `Result: ${naturalLanguage}\n`,
        danger_level: 0,
      });
    }

    return {
      task_id: Date.now().toString(16),
      title: naturalLanguage.slice(0, 40),
      steps,
    };
  }
}

// �w�w�w DeepSeek Adapter �w�w�w

class DeepseekAdapter implements AiAdapter {
  async generatePlan(naturalLanguage: string, context?: Record<string, unknown>): Promise<TaskPlan> {
    const messages = this.buildMessages(naturalLanguage, context);
    const response = await this.callApi(messages);
    return this.parseResponse(response);
  }

  private buildMessages(task: string, context?: Record<string, unknown>): Array<{ role: string; content: string }> {
    const systemPrompt = `You are an AI coding assistant. You help users by both chatting with them and executing file/command operations.

For EVERY response, you MUST output valid JSON with this exact schema:
{
  "title": "简短的任务标题",
  "response": "你对用户的自然语言回复，用中文，友好简洁说明你做了什么",
  "steps": [
    {
      "type": "file_edit",
      "description": "简短的操作说明",
      "files": ["文件路径"],
      "content": "修改后文件的完整内容（不是修改说明，是整个文件的新内容！）",
      "danger_level": 0
    }
  ]
}

IMPORTANT RULES:
1. The 'response' field MUST contain your natural language reply to the user in Chinese.
2. For file_edit steps: 'content' MUST be the COMPLETE new file content. Include the ENTIRE file, not just the changes.
3. When modifying an existing file, ALWAYS output the full file content in 'content', with your changes applied.
4. If no changes are needed, return an empty steps array.
5. Output only valid JSON, no extra text.`;

    let contextStr = '';
    if (context) {
      contextStr = '\nContext:\n' + JSON.stringify(context, null, 2);
    }

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Task: ${task}\n${contextStr}\n\nReturn JSON plan.` },
    ];
  }

  private async callApi(messages: Array<{ role: string; content: string }>): Promise<string> {
    // Read dynamic config at call time
    const { DYNAMIC_DEEPSEEK_KEY, DYNAMIC_DEEPSEEK_URL, DYNAMIC_DEEPSEEK_MODEL } = require('../config');
    const payload = {
      model: DYNAMIC_DEEPSEEK_MODEL,
      messages,
      temperature: 0.0,
      max_tokens: 4096,
    };

    const response = await axios.post(DYNAMIC_DEEPSEEK_URL, payload, {
      headers: {
        'Authorization': `Bearer ${DYNAMIC_DEEPSEEK_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    return response.data.choices?.[0]?.message?.content || '';
  }

  private parseResponse(text: string): TaskPlan {
    // DeepseekAdapter.parseResponse
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TaskPlan;
      }
    } catch {
      // Try Strategy 2: strip markdown code blocks and retry
      try {
        const cleaned = text.replace(/```(?:json)?\s*/gi, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as TaskPlan;
        }
      } catch {
        // fallback
      }
    }
    return {
      task_id: Date.now().toString(16),
      title: 'Parsed Plan',
      steps: [{ description: text.slice(0, 100), type: 'command', command: 'echo "Parsed from response"', danger_level: 0 }],
    };
  }
}

// �w�w�w Claude Adapter �w�w�w

class ClaudeAdapter implements AiAdapter {
  async generatePlan(naturalLanguage: string, context?: Record<string, unknown>): Promise<TaskPlan> {
    const prompt = this.buildPrompt(naturalLanguage, context);
    const response = await this.callApi(prompt);
    return this.parseResponse(response);
  }

  private buildPrompt(task: string, context?: Record<string, unknown>): string {
    let contextStr = '';
    if (context) {
      contextStr = '\nContext:\n' + JSON.stringify(context, null, 2);
    }
    return `You are an AI coding assistant. You help users by chatting with them and executing file/command operations.

For EVERY response, you MUST output valid JSON:
{
  "title": "简短的任务标题",
  "response": "你对用户的自然语言回复，用中文",
  "steps": [
    {
      "type": "file_edit",
      "description": "操作说明",
      "files": ["文件路径"],
      "content": "修改后文件的完整内容（是整个文件，不是修改说明！）",
      "danger_level": 0
    }
  ]
}

IMPORTANT RULES:
1. 'response' field = your natural language reply in Chinese.
2. file_edit 'content' = the COMPLETE modified file, NOT a description of changes.
3. When modifying a file, output the full file content with changes applied.
4. Return empty steps if no changes needed.
5. Output valid JSON only, no extra text.
Task: ${task}${contextStr}\n\nJSON:`;
  }

  private async callApi(prompt: string): Promise<string> {
    const { DYNAMIC_CLAUDE_KEY, DYNAMIC_CLAUDE_URL, DYNAMIC_CLAUDE_MODEL } = require('../config');
    const payload = {
      model: DYNAMIC_CLAUDE_MODEL,
      prompt: `Human: ${prompt}\n\nAssistant:`,
      max_tokens_to_sample: 4096,
      temperature: 0.0,
      stop_sequences: ['\n\nHuman:'],
    };

    const response = await axios.post(DYNAMIC_CLAUDE_URL, payload, {
      headers: {
        'Authorization': `Bearer ${DYNAMIC_CLAUDE_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    return response.data.completion || '';
  }

  private parseResponse(text: string): TaskPlan {
    // ClaudeAdapter.parseResponse
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TaskPlan;
      }
    } catch {
      // Try Strategy 2: strip markdown code blocks and retry
      try {
        const cleaned = text.replace(/```(?:json)?\s*/gi, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as TaskPlan;
        }
      } catch {
        // fallback
      }
    }
    return {
      task_id: Date.now().toString(16),
      title: 'Claude Plan',
      steps: [{ description: text.slice(0, 100), type: 'command', command: 'echo "Parsed from response"', danger_level: 0 }],
    };
  }
}

// �w�w�w Factory �w�w�w

function getAiAdapter(): AiAdapter {
  if (USE_MOCK_CLAUDE) {
    defaultLogger.info('Using Mock AI adapter');
    return new MockAdapter();
  }

  if (DYNAMIC_PROVIDER === 'deepseek' && DYNAMIC_DEEPSEEK_KEY) {
    defaultLogger.info('Using Deepseek AI adapter');
    return new DeepseekAdapter();
  }

  if (DYNAMIC_PROVIDER === 'claude' && DYNAMIC_CLAUDE_KEY) {
    defaultLogger.info('Using Claude AI adapter');
    return new ClaudeAdapter();
  }

  defaultLogger.info('No API key configured, using Mock adapter');
  return new MockAdapter();
}

export { AiAdapter, MockAdapter, DeepseekAdapter, ClaudeAdapter, getAiAdapter };
