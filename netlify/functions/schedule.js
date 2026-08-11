import { getStore } from "@netlify/blobs";

const CONFIG_KEY = "config";

function scheduleKey(date) {
  return `schedule-${date}`;
}

function emptySchedule() {
  return { AM: {}, PM: {} };
}

// Look up how many seats a workstation has (defaults to 1 if not found
// or not set, so older/malformed config data never breaks sign-in).
function getWorkstationCapacity(configData, workstationId) {
  for (const loc of configData.locations || []) {
    for (const ws of loc.workstations || []) {
      if (ws.id === workstationId) {
        const n = parseInt(ws.capacity, 10);
        return Number.isFinite(n) && n > 0 ? n : 1;
      }
    }
  }
  return 1;
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

    const { date, shift, staffId, locationId, workstationId, replaceStaffId } = body;

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
    const shiftAssignments = current[shift];

    if (locationId === null || locationId === undefined) {
      // Clearing this person's assignment for the shift
      delete shiftAssignments[staffId];
      await store.setJSON(key, current);
      return Response.json(current);
    }

    if (workstationId) {
      // If this sign-in is explicitly taking over a specific person's seat,
      // clear that person's assignment first — but only if they're actually
      // still the one sitting in that seat (avoids clobbering someone who
      // has since moved elsewhere).
      if (
        replaceStaffId &&
        shiftAssignments[replaceStaffId] &&
        shiftAssignments[replaceStaffId].workstationId === workstationId
      ) {
        delete shiftAssignments[replaceStaffId];
      }

      // Capacity check: count how many *other* staff currently occupy this
      // workstation before allowing the new sign-in.
      const configData = (await store.get(CONFIG_KEY, { type: "json" })) || { locations: [] };
      const capacity = getWorkstationCapacity(configData, workstationId);
      const otherOccupants = Object.entries(shiftAssignments).filter(
        ([sid, a]) => sid !== staffId && a.workstationId === workstationId
      ).length;

      if (otherOccupants >= capacity) {
        return new Response("Workstation is full", { status: 409 });
      }
    }

    shiftAssignments[staffId] = {
      locationId,
      workstationId: workstationId || null
    };

    await store.setJSON(key, current);
    return Response.json(current);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/schedule"
};
