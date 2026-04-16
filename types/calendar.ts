export type EventCategory  = 'Work' | 'Personal' | 'Health' | 'Study' | 'Finance' | 'Other'
export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type EventReminder  = 'none' | 'at_time' | '1_day_before' | '2_days_before'

export const REMINDER_LABELS: Record<EventReminder, string> = {
  none:          'None',
  at_time:       'At time of event',
  '1_day_before':  '1 day before',
  '2_days_before': '2 days before',
}

export const CATEGORIES: EventCategory[] = ['Work', 'Personal', 'Health', 'Study', 'Finance', 'Other']

export const CATEGORY_COLORS: Record<EventCategory, { bg: string; text: string; dot: string }> = {
  Work:     { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  Personal: { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  Health:   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  Study:    { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  Finance:  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  Other:    { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
}

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  start_datetime: string
  end_datetime: string
  all_day: boolean
  location: string | null
  category: EventCategory
  recurrence: EventRecurrence
  reminder: EventReminder
  created_at: string
  updated_at: string
}

export type EventInput = Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>
