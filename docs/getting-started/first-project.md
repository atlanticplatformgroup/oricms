# Create Your First Project

This guide walks through the smallest useful OriCMS setup: one project, one content type, one collection, and one entry.

By the end, you should have a project that feels real instead of empty.

## 1. Create the Project

From the first-run onboarding flow:

1. Enter the project name.
2. Choose either:
   - **Express** to launch a managed project
   - **Advanced** to connect an existing remote repository

For most teams, **Express** is the right starting point.

That project now becomes the unit that owns content, members, settings, preview targets, and delivery behavior.

## 2. Let OriCMS Create the Repository

In the default **Express** path, you do **not** need to create a Git repository yourself first.

OriCMS initializes a managed local Git repository on the server automatically. You can connect that project to GitHub later if you want to.

If you use the **Advanced** path instead, you provide a repository URL up front and OriCMS connects to that remote repository during setup.

Either way, the important outcome is the same: the project ends up with a Git-backed workspace that OriCMS can manage server-side.

## 3. Create a First Content Type

Open **Schemas** and create a simple content type.

A `blog-post` type is a good first example.

Typical first fields:

- `title`
- `slug`
- `subtitle`
- `body`
- `author`
- `publishedAt`

Keep the first schema deliberately small. You can add structure once the basic workflow feels right.

## 4. Create a Collection

Open **Collections** and create a collection that uses the type you just defined.

Example:

- collection name: `blog-posts`
- content type: `blog-post`
- storage path: `content/blog-posts`

This is the step that turns a schema into something editors can actually use.

## 5. Check the Repository Shape

After saving the content type and collection, the project repository should look roughly like this:

```text
repo/
├── oricms/
│   └── collections.json
├── schemas/
│   └── types/
│       └── blog-post.json
└── content/
    └── blog-posts/
```

More files will appear as you add content, but this is the baseline shape OriCMS expects.

## 6. Create the First Entry

Open the collection and create one entry.

For the first pass:

- give it a clear title
- include a slug if the schema expects one
- save it as a draft

Important identity rule:

- `$id` is the real entry identifier
- `slug` is not guaranteed to become the entry id

## 7. Verify the Project Feels Healthy

Your first project is in a good state when:

- the collection browse screen lists the new entry
- the editor loads the expected form fields
- the entry has history
- preview can resolve the entry if the project already has a preview target

## Next

- [First Publish](./first-publish.md)
- [Content Modeling](../guides/content-modeling.md)
- [Members and Agents](../guides/members-and-agents.md)
