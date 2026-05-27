export class AgentAccessError extends Error {
  constructor(
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'AgentAccessError';
  }
}
