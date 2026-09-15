"use client";

import { useSyncExternalStore } from "react";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  time: string;
  message: string;
  level: LogLevel;
}

const MAX_ENTRIES = 200;

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

export function pushLog(message: string, level: LogLevel = "info"): void {
  entries = [...entries, { id: nextId++, time: timestamp(), message, level }].slice(
    -MAX_ENTRIES
  );
  listeners.forEach((listener) => listener());
}

/** Real action wired to SystemLogPanel's clear button — actually empties the log. */
export function clearLogs(): void {
  entries = [];
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): LogEntry[] {
  return entries;
}

const EMPTY_ENTRIES: LogEntry[] = [];

function getServerSnapshot(): LogEntry[] {
  return EMPTY_ENTRIES;
}

export function useLogs(): LogEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
