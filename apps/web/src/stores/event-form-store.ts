import { create } from 'zustand';

type ScheduleType = 'dates_only' | 'dates_and_times' | 'days_of_week';

const initialState = {
  title: '',
  description: '',
  scheduleType: 'dates_and_times' as ScheduleType, //placeholder, change when designer is done
};

type EventFormStore = {
  title: string;
  description: string;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  scheduleType: ScheduleType;
  setScheduleType: (scheduleType: ScheduleType) => void;
  reset: () => void;
};

export const useEventFormStore = create<EventFormStore>((set) => ({
  ...initialState,
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setScheduleType: (scheduleType) => set({ scheduleType }),
  reset: () => set(initialState),
}));
