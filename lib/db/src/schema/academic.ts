import { date, integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  section: text("section").notNull(),
  attendanceRate: real("attendance_rate").notNull(),
  status: text("status").notNull(),
  initials: text("initials").notNull(),
});

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  studentName: text("student_name").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timetableTable = pgTable("timetable", {
  id: serial("id").primaryKey(),
  day: text("day").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  subject: text("subject").notNull(),
  room: text("room").notNull(),
  teacher: text("teacher").notNull(),
  color: text("color").notNull(),
});

export const leavePlansTable = pgTable("leave_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  days: integer("days").notNull(),
  status: text("status").notNull(),
  impact: text("impact").notNull(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export const insertTimetableSchema = createInsertSchema(timetableTable).omit({ id: true });
export const insertLeavePlanSchema = createInsertSchema(leavePlansTable).omit({ id: true });

export type Student = z.infer<typeof insertStudentSchema> & { id: number };
export type Attendance = z.infer<typeof insertAttendanceSchema> & { id: number };
export type TimetableEntry = z.infer<typeof insertTimetableSchema> & { id: number };
export type LeavePlan = z.infer<typeof insertLeavePlanSchema> & { id: number };