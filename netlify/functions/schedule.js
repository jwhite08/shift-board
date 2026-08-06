import { getStore } from "@netlify/blobs";

function scheduleKey(date) {
  return `schedule-${date}`;
}

function emptySchedule() {
  return { AM: {}, PM: {} };
}

export default async (req) => {
  const store = getStore("shift-board");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const date = url.searchParams.get("date");
    if (!date) {
      return new Response("Missing 'date' query param (YYYY-MM-DD)", {
        status: 400
      });
    }
    const existing = await store.get(scheduleKey(date), { type: "json" });
    return Response.json(existing || emptySchedule());
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { date, shift, staffId, locationId, workstationId } = body;

    if (!date || !shift || !staffId) {
      return new Response("Missing required fields: date, shift, staffId", {
        status: 400
      });
    }
    if (shift !== "AM" && shift !== "PM") {
      return new Response("shift must be 'AM' or 'PM'", { status: 400 });
    }

    const key = scheduleKey(date);
    const current = (await store.get(key, { type: "json" })) || emptySchedule();

    if (locationId === null || locationId === undefined) {
      // Clearing this person's assignment for the shift
      delete current[shift][staffId];
    } else {
      current[shift][staffId] = {
        locationId,
        workstationId: workstationId || null
      };
    }

    await store.setJSON(key, current);
    return Response.json(current);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/schedule"
};
