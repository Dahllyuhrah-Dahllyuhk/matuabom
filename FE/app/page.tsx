'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar } from '@/components/calendar';
import { EventDialog } from '@/components/event-dialog';
import { EventDetailModal } from '@/components/event-detail-modal';
import { BottomNav } from '@/components/bottom-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProtectedRoute } from '@/components/protected-route';

import {
  fetchAllCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  API_BASE,
} from '@/lib/api';
import { mapRawToCalendarEvent } from '@/lib/calendar-utils';
import type { RawCalendarEvent, Event } from '@/types/calendar';
import { useEventRefresh } from '@/hooks/useEventRefresh';

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());

  const isMobile = useIsMobile();

  // 🔥 전역 refresh 트리거
  const { trigger, refresh } = useEventRefresh();

  // 서버 응답 → 화면용 이벤트로 변환 (기존 mapRaw 로직 유지)
  const mapRaw = (list: RawCalendarEvent[]): Event[] => {
    return list
      .map((raw, idx) => {
        const baseEvent = mapRawToCalendarEvent(raw, idx);
        const existingColor = colorMap.get(raw.id);
        return {
          ...baseEvent,
          color: existingColor || baseEvent.color,
        };
      })
      .filter(
        (e) =>
          !Number.isNaN(e.startDate.getTime()) &&
          !Number.isNaN(e.endDate.getTime())
      )
      .sort(
        (a: Event, b: Event) => a.startDate.getTime() - b.startDate.getTime()
      );
  };

  // ✅ 1) trigger 가 바뀔 때마다 전체 이벤트 다시 로딩
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const raw = await fetchAllCalendarEvents(); // 전체 기간 로딩
        if (cancelled) return;
        setEvents(mapRaw(raw as RawCalendarEvent[]));
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? '데이터를 불러올 수 없습니다');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // ✅ 2) SSE 구독: BE(Webhook/증분 동기화) → FE 실시간 반영
  useEffect(() => {
    // API_BASE 는 http://localhost:8080 같은 BE 주소
    const sseUrl = `${API_BASE}/api/sse/events`;

    const es = new EventSource(sseUrl);

    es.addEventListener('events-updated', () => {
      // DB에서 일정 변경이 감지되면 전역 refresh 트리거
      refresh();
    });

    es.onerror = () => {
      // 네트워크 끊기면 일단 닫아둔다 (필요하면 재시도 로직 추가 가능)
      es.close();
    };

    return () => {
      es.close();
    };
  }, [refresh]);

  // =============================
  // 캘린더 인터랙션 핸들러들
  // =============================

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
    setIsEditMode(false);
  };

  const handleDateRangeSelect = (start: Date, end: Date) => {
    setSelectedDateRange({ start, end });
    setSelectedEvent(null);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsEditMode(true);
    setIsDetailModalOpen(false);
    setIsDialogOpen(true);
  };

  // 모바일에서 날짜 셀의 "+" 버튼 같은 걸 눌렀을 때 호출된다고 가정
  const handleCreateNewEventFromBottomSheet = (date: Date) => {
    setSelectedDateRange({
      start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      end: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    });
    setSelectedEvent(null);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  // ✅ 기존 동기화 버튼: 구글 OAuth 시작
  const syncNow = () => {
    const base = API_BASE || 'http://localhost:8080';
    window.location.href = `${base}/oauth2/authorization/google`;
    // 실제 동기화는 BE에서 처리 후, 다시 / 로 redirect 됨.
    // 새로 진입하면서 useEffect(trigger) 가 동작해 다시 fetch 하므로 화면도 최신화.
  };

  // =============================
  // 저장 / 삭제
  // =============================

  const handleSaveEvent = async (event: Event) => {
    setIsDialogOpen(false);
    if (event.id) {
      setColorMap((prev) => new Map(prev).set(event.id, event.color));
    }
    setSelectedEvent(null);
    setSelectedDateRange(null);
    setIsEditMode(false);

    try {
      setError(null);

      const formatToISO = (
        date: Date,
        allDay: boolean,
        isEndDate: boolean
      ): string => {
        if (allDay) {
          // 종일 일정이면 끝 날짜에 +1일 해서 [start, end) 구간으로 저장
          const dateToUse = isEndDate
            ? new Date(date.getTime() + 24 * 60 * 60 * 1000)
            : date;
          const year = dateToUse.getFullYear();
          const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
          const day = String(dateToUse.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        } else {
          return date.toISOString();
        }
      };

      const isAllDay = Boolean(event.allDay);

      const requestPayload = {
        title: event.title || '무제',
        description: event.description || '',
        start: formatToISO(event.startDate, isAllDay, false),
        end: formatToISO(event.endDate, isAllDay, isAllDay),
        allDay: isAllDay,
        timeZone: 'Asia/Seoul',
        color: event.color,
      };

      if (selectedEvent) {
        // 수정
        setEvents((prev) =>
          prev.map((e) =>
            e.id === selectedEvent.id ? { ...event, id: selectedEvent.id } : e
          )
        );
        await updateCalendarEvent(selectedEvent.id, requestPayload);
      } else {
        // 생성
        const tempId = `temp-${Date.now()}`;
        setEvents((prev) => [...prev, { ...event, id: tempId }]);
        const created = await createCalendarEvent(requestPayload);
        if (created?.id) {
          setColorMap((prev) => new Map(prev).set(created.id, event.color));
        }
      }

      // 한번 더 전체 동기화 (로컬 상태와 BE를 강제로 맞춰줌)
      const raw = await fetchAllCalendarEvents();
      setEvents(mapRaw(raw as RawCalendarEvent[]));

      // 🔥 전역 refresh 트리거 → 다른 탭/컴포넌트도 최신화
      refresh();
    } catch (err: any) {
      setError(err?.message ?? '일정 저장 중 오류가 발생했습니다');

      // 실패 시에도 BE 기준으로 다시 맞춰둠
      const raw = await fetchAllCalendarEvents();
      setEvents(mapRaw(raw as RawCalendarEvent[]));

      // 그래도 DB 업데이트가 있었다면 다른 곳도 맞춰야 하므로 refresh 한 번 날려도 됨
      refresh();
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setIsDetailModalOpen(false);
    setIsDialogOpen(false);
    setSelectedEvent(null);

    try {
      setError(null);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setColorMap((prev) => {
        const newMap = new Map(prev);
        newMap.delete(eventId);
        return newMap;
      });

      await deleteCalendarEvent(eventId);

      const raw = await fetchAllCalendarEvents();
      setEvents(mapRaw(raw as RawCalendarEvent[]));

      // 🔥 삭제 후에도 전역 refresh
      refresh();
    } catch (err: any) {
      if (err?.message?.includes('410')) {
        setError('이미 삭제된 일정입니다. 동기화를 진행합니다.');
      } else {
        setError(err?.message ?? '일정 삭제 중 오류가 발생했습니다');
      }
      const raw = await fetchAllCalendarEvents();
      setEvents(mapRaw(raw as RawCalendarEvent[]));

      // 에러 상황에서라도, DB 기준으로는 변경됐을 수 있으니 한 번 더 refresh
      refresh();
    }
  };

  // =============================
  // 렌더
  // =============================

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                맞춰봄 캘린더
              </span>
              <h1 className="text-lg font-semibold md:text-xl">
                {isMobile ? '내 일정' : '내 캘린더'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={syncNow}
                className="rounded-md border px-3 py-1 text-sm hover:bg-accent"
                title="구글 캘린더에서 최신 일정 동기화"
              >
                동기화
              </button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
            {error && (
              <Alert variant="destructive" className="mb-3 whitespace-pre-line">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
                캘린더를 불러오는 중입니다...
              </div>
            ) : (
              <Calendar
                events={events}
                onEventDoubleClick={handleEventClick}
                onDateRangeSelect={handleDateRangeSelect}
                onCreateNewEvent={handleCreateNewEventFromBottomSheet}
              />
            )}
          </div>
        </main>

        <EventDetailModal
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          event={selectedEvent}
          onDelete={handleDeleteEvent}
          onEdit={handleEditEvent}
        />

        <EventDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          event={isEditMode ? selectedEvent : null}
          dateRange={isEditMode ? selectedDateRange : null}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
