import { create } from 'zustand';

export type ScheduleType = 'dates_only' | 'dates_and_times' | 'days_of_week';

const initialState = {
  title: '',
  description: '',
  scheduleType: 'dates_only' as ScheduleType, //placeholder
  selectedDates: [] as Date[],
  selectedWeekdays: [] as number[],
  startTime: '09:00', //placeholder
  endTime: '17:00', //placeholder
};

type EventFormStore = {
  title: string;
  description: string;
  scheduleType: ScheduleType;
  selectedDates: Date[];
  selectedWeekdays: number[];
  startTime: string;
  endTime: string;

  reset: () => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setScheduleType: (scheduleType: ScheduleType) => void;
  setSelectedDates: (dates: Date[]) => void;
  setSelectedWeekdays: (weekdays: number[]) => void;
  setStartTime: (startTime: string) => void;
  setEndTime: (endTime: string) => void;
};

export const useEventFormStore = create<EventFormStore>((set) => ({
  ...initialState,
  reset: () => set(initialState),
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setScheduleType: (scheduleType) => set({ scheduleType }),
  setSelectedDates: (selectedDates) => set({ selectedDates }),
  setSelectedWeekdays: (selectedWeekdays) => set({ selectedWeekdays }),
  setStartTime: (startTime) => set({ startTime }),
  setEndTime: (endTime) => set({ endTime }),
}));
