import { useState, useEffect, useCallback } from 'react';
import { listSessions, createSession, deleteSession, continueSession } from '../api/client';
import { SessionItem } from '../types';

export function useSessions() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateSession = async (taskDescription: string, projectDir: string | null) => {
    try {
      const session = await createSession(taskDescription, projectDir);
      await fetchSessions();
      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create session';
      throw new Error(msg);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      await fetchSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete session';
      throw new Error(msg);
    }
  };

  const handleContinueSession = async (sessionId: string) => {
    try {
      const session = await continueSession(sessionId);
      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load session';
      throw new Error(msg);
    }
  };

  return {
    sessions,
    loading,
    fetchSessions,
    createSession: handleCreateSession,
    deleteSession: handleDeleteSession,
    continueSession: handleContinueSession,
  };
}