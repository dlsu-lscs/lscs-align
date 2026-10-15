import { create } from 'zustand';

export type ScheduleType = 'dates_only' | 'dates_and_times' | 'days_of_week';

const initialState = {
  title: '',
  description: '',
  scheduleType: 'dates_and_times' as ScheduleType, //placeholder, change when designer is done
  selectedDates: [] as Date[],
};

type EventFormStore = {
  title: string;
  description: string;
  scheduleType: ScheduleType;
  selectedDates: Date[];

  reset: () => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setScheduleType: (scheduleType: ScheduleType) => void;
  setSelectedDates: (dates: Date[]) => void;
};

export const useEventFormStore = create<EventFormStore>((set) => ({
  ...initialState,
  reset: () => set(initialState),
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setScheduleType: (scheduleType) => set({ scheduleType }),
  setSelectedDates: (selectedDates) => set({ selectedDates }),
}));
