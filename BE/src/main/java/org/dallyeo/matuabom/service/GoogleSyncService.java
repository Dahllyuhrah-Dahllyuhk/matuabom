package org.dallyeo.matuabom.service;

import lombok.RequiredArgsConstructor;
import org.dallyeo.matuabom.dto.CreateEventReq;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;

@Service
@RequiredArgsConstructor
public class GoogleSyncService {

    private final GoogleOAuthClientService googleTokens;
    private final GoogleCalendarService googleCalendarService;
    private final EventSseService eventSseService;

    /* ===========================
     *  1) 초기 / 증분 동기화
     * =========================== */

    /**
     * 구글 연동 직후 최초 동기화 + watch 등록
     * - JwtLoginSuccessHandler(handleGoogleLogin) 에서 호출
     */
    @Async("googleSyncExecutor")
    public void runInitialSync(String userId) {
        googleTokens.getTokens(userId).ifPresent(tokens -> {
            try {
                // syncToken 없으면 전체 동기화, 있으면 증분 동기화
                googleCalendarService.incrementalSync(tokens);
                googleTokens.save(tokens); // syncToken 반영

                // 웹훅 채널 등록 (watch)
                googleCalendarService.ensureWatchChannel(tokens);
                googleTokens.save(tokens); // channelId/resourceId/expiration 반영

                // 🔥 초기 동기화 끝나면 FE에게 알림
                eventSseService.sendEventsUpdated();
            } catch (GeneralSecurityException | IOException e) {
                e.printStackTrace();
            }
        });
    }

    /**
     * 구글에서 webhook 이 왔거나, 조회 시 최신화하고 싶을 때 사용
     * - GoogleWebhookController
     */
    @Async("googleSyncExecutor")
    public void runIncrementalSync(String userId) {
        googleTokens.getTokens(userId).ifPresent(tokens -> {
            try {
                googleCalendarService.incrementalSync(tokens);
                googleTokens.save(tokens);

                // 🔥 증분 동기화 끝나면 FE에게 알림
                eventSseService.sendEventsUpdated();
            } catch (GeneralSecurityException | IOException e) {
                e.printStackTrace();
            }
        });
    }

    /* ===========================
     *  2) 일정 생성/수정/삭제 비동기 동기화
     * =========================== */

    /**
     * 일정 생성 비동기 동기화
     * - DB에는 이미 createLocalEvent 로 저장된 상태라고 가정
     * - 여기서는 구글 쪽만 나중에 따라가게 만든다
     */
    @Async("googleSyncExecutor")
    public void syncCreateAsync(String userId, CreateEventReq req) {
        googleTokens.getTokens(userId).ifPresent(tokens -> {
            try {
                googleCalendarService.createGoogleEvent(tokens, userId, req);
            } catch (GeneralSecurityException | IOException e) {
                e.printStackTrace();
            }
        });
    }

    /**
     * 일정 수정 비동기 동기화
     */
    @Async("googleSyncExecutor")
    public void syncUpdateAsync(String userId, String eventId, CreateEventReq req) {
        googleTokens.getTokens(userId).ifPresent(tokens -> {
            try {
                googleCalendarService.updateGoogleEvent(tokens, userId, eventId, req);
            } catch (GeneralSecurityException | IOException e) {
                e.printStackTrace();
            }
        });
    }

    /**
     * 일정 삭제 비동기 동기화
     */
    @Async("googleSyncExecutor")
    public void syncDeleteAsync(String userId, String eventId) {
        googleTokens.getTokens(userId).ifPresent(tokens -> {
            try {
                googleCalendarService.deleteGoogleEvent(tokens, userId, eventId);
            } catch (GeneralSecurityException | IOException e) {
                e.printStackTrace();
            }
        });
    }
}
