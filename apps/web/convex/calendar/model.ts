import { v } from "convex/values";
export const eventFields = {
  title: v.string(),
  description: v.string(),
  location: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  allDay: v.boolean(),
  timezone: v.string(),
  color: v.string(),
};
