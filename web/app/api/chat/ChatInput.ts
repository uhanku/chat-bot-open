export default class ChatInput {
  constructor(
    public message: string,
    public sessionId: string,
    public language?: string,
  ) {
    this.message = message.trim();
  }
}
