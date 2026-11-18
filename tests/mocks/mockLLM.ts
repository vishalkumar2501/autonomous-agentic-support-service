import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { ChatGeneration, ChatResult } from '@langchain/core/outputs';

export interface ScriptedTurn {
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>;
  content?: string;
}

export class MockChatModel extends BaseChatModel {
  private turns: ScriptedTurn[];
  private currentTurn = 0;

  constructor(turns: ScriptedTurn[]) {
    super({});
    this.turns = turns;
  }

  _llmType(): string {
    return 'mock-chat-model';
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
  ): Promise<ChatResult> {
    const turn = this.turns[this.currentTurn] || {
      content: JSON.stringify({
        decision: 'ESCALATE',
        confidence: 0.5,
        reasoning: 'Fallback mock escalation',
        customerMessage: 'Your issue has been transferred to a support representative.',
        actionsTaken: [],
      }),
    };

    this.currentTurn++;

    const aiMessage = new AIMessage({
      content: turn.content || '',
      tool_calls: turn.toolCalls?.map((tc, idx) => ({
        name: tc.name,
        args: tc.args,
        id: tc.id || `call_mock_${this.currentTurn}_${idx}`,
        type: 'tool_call',
      })),
    });

    const generation: ChatGeneration = {
      text: aiMessage.content.toString(),
      message: aiMessage,
    };

    return {
      generations: [generation],
    };
  }

  reset(): void {
    this.currentTurn = 0;
  }

  setTurns(turns: ScriptedTurn[]): void {
    this.turns = turns;
    this.currentTurn = 0;
  }
}
