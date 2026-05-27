'use client';

import { useState, useCallback, useEffect } from 'react';
import type { DetectionRecord } from '@/lib/fall-detector';

const STORAGE_KEY = 'fall_detection_history';
const MAX_RECORDS = 100;

export function useDetectionHistory() {
  const [records, setRecords] = useState<DetectionRecord[]>([]);

  // 从 localStorage 加载
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecords(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // 保存到 localStorage
  const persist = useCallback((newRecords: DetectionRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords.slice(0, MAX_RECORDS)));
    } catch {
      // ignore
    }
  }, []);

  const addRecord = useCallback((record: DetectionRecord) => {
    setRecords((prev) => {
      const next = [record, ...prev].slice(0, MAX_RECORDS);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearRecords = useCallback(() => {
    setRecords([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  // 统计数据
  const stats = {
    total: records.length,
    falls: records.filter((r) => r.isFall).length,
    normal: records.filter((r) => !r.isFall).length,
    byType: {
      image: records.filter((r) => r.type === 'image').length,
      video: records.filter((r) => r.type === 'video').length,
      camera: records.filter((r) => r.type === 'camera').length,
    },
  };

  return { records, addRecord, clearRecords, deleteRecord, stats };
}
