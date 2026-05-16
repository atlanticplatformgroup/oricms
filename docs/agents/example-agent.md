# Example Agent

This page shows a minimal, sane OriCMS agent workflow.

The point is not to provide a production SDK. It is to show the order of operations a real integration should follow.

## Recommended Flow

1. authenticate with a bearer token
2. call bootstrap first
3. inspect schemas or collection structure as needed
4. preflight before destructive or workflow-changing mutations
5. trust returned `entryId` / `$id` after creates

That sequence matters more than the specific language example.

## Python Example

```python
import os
import requests

BASE_URL = os.environ["ORICMS_BASE_URL"].rstrip("/")
TOKEN = os.environ["ORICMS_AGENT_TOKEN"]

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

def get(path: str, **kwargs):
    response = requests.get(f"{BASE_URL}{path}", headers=headers, **kwargs)
    response.raise_for_status()
    return response.json()["data"]

def post(path: str, body: dict, extra_headers: dict | None = None):
    merged_headers = dict(headers)
    if extra_headers:
        merged_headers.update(extra_headers)
    response = requests.post(f"{BASE_URL}{path}", headers=merged_headers, json=body)
    response.raise_for_status()
    return response.json()["data"]

bootstrap = get("/api/v1/agent/v1/bootstrap")
print("Project:", bootstrap["project"]["name"])
print("Role:", bootstrap["project"]["role"])
print("Writable collections:", bootstrap["capabilities"]["writableCollections"])

entries_response = requests.get(
    f"{BASE_URL}/api/v1/agent/v1/collections/blog-posts/entries",
    headers=headers,
    params={"page": 1, "pageSize": 5},
)
entries_response.raise_for_status()
entries = entries_response.json()["data"]
print("Loaded entries:", len(entries))

preflight = post(
    "/api/v1/agent/v1/preflight",
    {
        "action": "transition",
        "collectionName": "blog-posts",
        "entryId": "hello-world",
        "targetStatus": "published",
    },
)

if preflight["allowed"]:
    publish_result = post(
        "/api/v1/agent/v1/collections/blog-posts/entries/hello-world/transition",
        {"targetStatus": "published"},
        extra_headers={"Idempotency-Key": "publish-hello-world-001"},
    )
    print("Published status:", publish_result["resultingStatus"])
```

## Node.js Example

```ts
const baseUrl = process.env.ORICMS_BASE_URL!.replace(/\/$/, "");
const token = process.env.ORICMS_AGENT_TOKEN!;

async function agentFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json();
}

const bootstrap = await agentFetch("/api/v1/agent/v1/bootstrap");
console.log(bootstrap.data.project);

const preflight = await agentFetch("/api/v1/agent/v1/preflight", {
  method: "POST",
  body: JSON.stringify({
    action: "create",
    collectionName: "blog-posts",
    data: {
      title: "Agent-created post",
      slug: "agent-created-post",
      content: "Hello from the agent API.",
    },
  }),
});

if (preflight.data.allowed) {
  const result = await agentFetch("/api/v1/agent/v1/collections/blog-posts/entries", {
    method: "POST",
    headers: {
      "Idempotency-Key": "create-agent-post-001",
    },
    body: JSON.stringify({
      title: "Agent-created post",
      slug: "agent-created-post",
      content: "Hello from the agent API.",
    }),
  });

  console.log(result.data.entryId);
  console.log(result.data.entry?.$id);
}
```

## Practical Notes

- agents are role-based, not tier-based
- `viewer` is the narrowest non-mutating agent role; do not assume it exposes every read surface
- `editor` and `admin` agents can mutate collections when project write policy allows it
- use `preflight` before delete and before publish/unpublish transitions
- deletes require the confirmation token returned by preflight
- `published` is the persisted status value behind the UI label `Ready`
- use the response payload, not local assumptions, as the authoritative result of a mutation
