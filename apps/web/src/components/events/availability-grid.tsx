'use client';

import { format, parseISO } from 'date-fns';
import { buildSlotMinutes, slotKey } from '@/lib/availability';
import { formatTime } from '@/lib/time';
import { Fragment, useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type AvailabilityGridProps = {
  schedule_type: string;
  columns: (string | number)[];
  start_minute: number;
  end_minute: number;
  interval_minutes: number;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  submitted: boolean;
};

export function AvailabilityGrid({
  schedule_type,
  columns,
  start_minute,
  end_minute,
  interval_minutes,
  selected,
  setSelected,
  submitted,
}: AvailabilityGridProps) {
  const rows = buildSlotMinutes(start_minute, end_minute, interval_minutes);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');

  function applySlot(key: string, mode: 'select' | 'deselect') {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === 'select') {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function onMouseDown(key: string) {
    if (submitted) return;
    const mode = selected.has(key) ? 'deselect' : 'select';
    setDragMode(mode);
    setIsDragging(true);
    applySlot(key, mode);
  }

  function onMouseEnter(key: string) {
    if (submitted) return;
    if (isDragging) {
      applySlot(key, dragMode);
    }
  }

  useEffect(() => {
    const stop = () => setIsDragging(false);
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  return (
    <div className="flex select-none">
      <div className="flex flex-col gap-[0.5px] pt-[0.5px]">
        {rows.map((minute) => (
          <div
            key={minute}
            className="flex h-[31px] items-center justify-end pr-3 text-right text-[16px] 
                 leading-[normal] font-normal tracking-tighter text-[#777777]"
          >
            {formatTime(minute)}
          </div>
        ))}
      </div>

      <div className="flex-1">
        <div
          className="grid gap-[0.5px] border-[0.5px] border-ink bg-ink"
          style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
        >
          {rows.map((minute) => (
            <Fragment key={minute}>
              {columns.map((column) => {
                const key = slotKey(column, minute);
                const isSelected = selected.has(key);

                return (
                  <div
                    key={key}
                    onMouseDown={() => onMouseDown(key)}
                    onMouseEnter={() => onMouseEnter(key)}
                    className={`h-[31px] cursor-pointer ${isSelected ? (submitted ? 'bg-brand' : 'bg-[#50CF95]') : 'bg-[#D9D9D9]'}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>

        <div
          className="mt-2 grid"
          style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
        >
          {columns.map((column) => (
            <div
              key={column}
              className="text-center text-[16px] leading-[normal] font-normal tracking-tighter text-[#777777]"
            >
              {schedule_type === 'days_of_week'
                ? WEEKDAYS[column as number]
                : format(parseISO(column as string), 'MMM d')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
