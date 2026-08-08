import { and, asc, count, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateLeavePlanBody,
  CreateLeavePlanResponse,
  GetDashboardResponse,
  GetStudentParams,
  GetStudentResponse,
  ListAttendanceQueryParams,
  ListAttendanceResponse,
  ListStudentsResponse,
  ListTimetableResponse,
  ListLeavePlansResponse,
  MarkAttendanceBody,
  MarkAttendanceResponse,
  ReviewTimetableBody,
  ReviewTimetableResponse,
} from "@workspace/api-zod";
import {
  attendanceTable,
  db,
  leavePlansTable,
  studentsTable,
  timetableTable,
} from "@workspace/db";

const router: IRouter = Router();

const seedStudents = [
  ["Amelia Stone", "Year 10", "A", 96.4, "present", "AS"],
  ["Noah Williams", "Year 10", "A", 91.8, "present", "NW"],
  ["Olivia Chen", "Year 10", "A", 88.2, "late", "OC"],
  ["Liam Carter", "Year 10", "A", 78.6, "absent", "LC"],
  ["Mia Patel", "Year 10", "A", 94.1, "present", "MP"],
  ["Ethan Brooks", "Year 10", "A", 86.7, "present", "EB"],
  ["Sofia Ramirez", "Year 10", "A", 97.2, "present", "SR"],
  ["Lucas Martin", "Year 10", "A", 82.4, "excused", "LM"],
] as const;

const seedTimetable = [
  ["Monday", "08:30", "09:30", "Mathematics", "Room 204", "Ms. Harper", "#4059aa"],
  ["Monday", "09:45", "10:45", "English Literature", "Room 118", "Mr. Singh", "#4b41e1"],
  ["Monday", "11:00", "12:00", "Biology", "Lab 2", "Dr. Moore", "#0f766e"],
  ["Tuesday", "08:30", "09:30", "History", "Room 307", "Ms. Adams", "#b45309"],
  ["Tuesday", "09:45", "10:45", "Physics", "Lab 1", "Mr. Wilson", "#be123c"],
  ["Wednesday", "08:30", "09:30", "Mathematics", "Room 204", "Ms. Harper", "#4059aa"],
  ["Wednesday", "11:00", "12:00", "Art & Design", "Studio 1", "Ms. Green", "#7c3aed"],
  ["Thursday", "09:45", "10:45", "Computer Science", "Lab 4", "Mr. Davis", "#0369a1"],
  ["Friday", "08:30", "09:30", "Physical Education", "Gym", "Coach Reed", "#15803d"],
] as const;

let seeded = false;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const [{ value }] = await db.select({ value: count() }).from(studentsTable);
  if (value === 0) {
    await db.insert(studentsTable).values(
      seedStudents.map(([name, grade, section, attendanceRate, status, initials]) => ({
        name,
        grade,
        section,
        attendanceRate,
        status,
        initials,
      })),
    );
  }
  const [{ value: timetableCount }] = await db.select({ value: count() }).from(timetableTable);
  if (timetableCount === 0) {
    await db.insert(timetableTable).values(
      seedTimetable.map(([day, startTime, endTime, subject, room, teacher, color]) => ({
        day,
        startTime,
        endTime,
        subject,
        room,
        teacher,
        color,
      })),
    );
  }
  const [{ value: leaveCount }] = await db.select({ value: count() }).from(leavePlansTable);
  if (leaveCount === 0) {
    await db.insert(leavePlansTable).values([
      {
        title: "October half-term cover",
        startDate: "2026-10-26",
        endDate: "2026-10-30",
        days: 5,
        status: "optimized",
        impact: "Low impact · 2 cover teachers needed",
      },
      {
        title: "Winter term planning",
        startDate: "2026-12-21",
        endDate: "2026-12-23",
        days: 3,
        status: "draft",
        impact: "Review class coverage before submitting",
      },
    ]);
  }
  const [{ value: attendanceCount }] = await db.select({ value: count() }).from(attendanceTable);
  if (attendanceCount === 0) {
    const students = await db.select().from(studentsTable).orderBy(asc(studentsTable.id));
    await db.insert(attendanceTable).values(
      students.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        date: today(),
        status: student.status,
        note: student.status === "absent" ? "Family notification pending" : null,
      })),
    );
  }
  seeded = true;
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const students = await db.select().from(studentsTable);
  const presentToday = students.filter((student) => student.status === "present").length;
  const classesToday = (await db.select().from(timetableTable)).filter((entry) => entry.day === "Monday").length;
  const data = {
    attendanceRate: Number((students.reduce((sum, student) => sum + student.attendanceRate, 0) / students.length).toFixed(1)),
    presentToday,
    totalStudents: students.length,
    classesToday,
    weeklyTrend: [
      { day: "Mon", rate: 94.2 },
      { day: "Tue", rate: 92.8 },
      { day: "Wed", rate: 95.1 },
      { day: "Thu", rate: 93.7 },
      { day: "Fri", rate: 96.4 },
    ],
    alerts: [
      "2 students below the 80% attendance threshold",
      "1 unresolved absence needs a family note",
      "Tomorrow's timetable has a room conflict",
    ],
  };
  res.json(GetDashboardResponse.parse(data));
});

router.get("/students", async (_req, res): Promise<void> => {
  await ensureSeeded();
  res.json(ListStudentsResponse.parse(await db.select().from(studentsTable).orderBy(asc(studentsTable.name))));
});

router.get("/students/:id", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = GetStudentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, parsed.data.id));
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(GetStudentResponse.parse(student));
});

router.get("/attendance", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = ListAttendanceQueryParams.safeParse({
    date: req.query.date ? new Date(String(req.query.date)) : undefined,
    week: req.query.week,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = parsed.data.date
    ? await db.select().from(attendanceTable).where(eq(attendanceTable.date, parsed.data.date.toISOString().slice(0, 10)))
    : await db.select().from(attendanceTable).orderBy(asc(attendanceTable.studentName));
  res.json(ListAttendanceResponse.parse(rows));
});

router.post("/attendance", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = MarkAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const date = parsed.data.date.toISOString().slice(0, 10);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, parsed.data.studentId));
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  const [existing] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.studentId, student.id), eq(attendanceTable.date, date)),
  );
  const [record] = existing
    ? await db.update(attendanceTable).set({ status: parsed.data.status, note: parsed.data.note ?? null }).where(eq(attendanceTable.id, existing.id)).returning()
    : await db.insert(attendanceTable).values({
      studentId: student.id,
      studentName: student.name,
      date,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
    }).returning();
  await db.update(studentsTable).set({ status: parsed.data.status }).where(eq(studentsTable.id, student.id));
  res.status(201).json(MarkAttendanceResponse.parse(record));
});

router.get("/timetable", async (_req, res): Promise<void> => {
  await ensureSeeded();
  res.json(ListTimetableResponse.parse(await db.select().from(timetableTable).orderBy(asc(timetableTable.id))));
});

router.get("/leave-plans", async (_req, res): Promise<void> => {
  await ensureSeeded();
  res.json(ListLeavePlansResponse.parse(await db.select().from(leavePlansTable).orderBy(asc(leavePlansTable.startDate))));
});

router.post("/leave-plans", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = CreateLeavePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const startDate = parsed.data.startDate.toISOString().slice(0, 10);
  const endDate = parsed.data.endDate.toISOString().slice(0, 10);
  const [plan] = await db.insert(leavePlansTable).values({
    title: parsed.data.title,
    startDate,
    endDate,
    days: dayCount(startDate, endDate),
    status: "draft",
    impact: "AI review pending · coverage not yet optimized",
  }).returning();
  res.status(201).json(CreateLeavePlanResponse.parse(plan));
});

router.post("/ai/timetable-review", async (req, res): Promise<void> => {
  const parsed = ReviewTimetableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(ReviewTimetableResponse.parse({
    score: 87,
    summary: `The timetable is strong for ${parsed.data.focus.toLowerCase()}, with balanced teaching load across the week.`,
    suggestions: [
      "Move Physics to the larger lab to reduce the Tuesday morning capacity risk.",
      "Protect a 20-minute transition before Wednesday Art & Design.",
      "Pair the Friday practical session with a second available supervisor.",
    ],
    conflicts: ["Tuesday · Physics · Lab 1 has a 4-seat capacity gap"],
  }));
});

export default router;