# PII Redaction

OriCMS applies PII redaction and field-level visibility filtering when content passes through the agent gateway.

The purpose is straightforward: agents should be able to work with project content without being given raw access to every sensitive string in that content.

## What The Gateway Does Today

The current gateway does two separate things:

- it hides schema fields marked `agentVisible: false`
- it scans visible string content for supported PII patterns and replaces matches with placeholders

Current placeholders include:

- `[EMAIL]`
- `[PHONE]`
- `[SSN]`
- `[CREDIT_CARD]`
- `[IP_ADDRESS]`
- `[ADDRESS]`

Hidden fields use the generic placeholder `[REDACTED]`.

## Supported Pattern Types

The current implementation scans for:

- email
- phone
- SSN
- credit card
- IP address
- street-address-like patterns

Some patterns are required by the implementation and cannot be disabled. Others are configurable in the PII redaction config.

## Field Visibility Matters Too

PII redaction is not the only control.

If a field in a content type is marked `agentVisible: false`, the gateway hides that field from agents before content reaches the model. In practice, that is the stronger tool when you already know a field should never be exposed to agent workflows.

## What Agent Builders Should Assume

Agents should be written as if sensitive strings may be replaced before they are returned.

That means:

- do not rely on email addresses or phone numbers as stable working identifiers
- prefer IDs and structured non-PII fields when the workflow depends on identity
- expect some content to come back partially redacted rather than fully omitted

## What This Does Not Mean

PII redaction is a useful safety layer, but it is not a blanket privacy guarantee.

It does not turn sensitive content into non-sensitive content, and it does not replace role scoping, collection restrictions, or careful field design. It is one control in the gateway, not the entire security story.

## Related Docs

- [overview.md](./overview.md)
- [authentication.md](./authentication.md)
- [../features/agent-gateway.md](../features/agent-gateway.md)
