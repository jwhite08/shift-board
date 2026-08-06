import { getStore } from "@netlify/blobs";

const CONFIG_KEY = "config";

// Starter data so the app renders something on first deploy.
// Replace all of this from the /admin.html page.
const DEFAULT_CONFIG = {
  locations: [
    {
      id: "loc-example-1",
      name: "EXAMPLE — Main Street Office",
      workstations: [
        { id: "ws-1", label: "Front Desk 1", extension: "1001" },
        { id: "ws-2", label: "Nurse Station", extension: "1002" },
        { id: "ws-3", label: "Provider Office A", extension: "1003" }
      ]
    },
    {
      id: "loc-example-2",
      name: "EXAMPLE — Endoscopy Center",
      workstations: [
        { id: "ws-4", label: "Front Desk", extension: "2001" },
        { id: "ws-5", label: "Pre-Op Bay 1", extension: "2002" }
      ]
    }
  ],
  staff: [
    { id: "staff-example-1", name: "Example Staff Member" }
  ]
};

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "content-type": "text/plain" }
  });
}

export default async (req) => {
  const store = getStore("shift-board");

  if (req.method === "GET") {
    const existing = await store.get(CONFIG_KEY, { type: "json" });
    return Response.json(existing || DEFAULT_CONFIG);
  }

  if (req.method === "POST" || req.method === "PUT") {
    const passcode = req.headers.get("x-admin-passcode") || "";
    const expected = process.env.ADMIN_PASSCODE || "";
    if (!expected || passcode !== expected) {
      return unauthorized();
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    if (!Array.isArray(body.locations) || !Array.isArray(body.staff)) {
      return new Response(
        "Config must include 'locations' and 'staff' arrays",
        { status: 400 }
      );
    }

    await store.setJSON(CONFIG_KEY, body);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/config"
};
