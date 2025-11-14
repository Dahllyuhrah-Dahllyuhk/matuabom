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
                // TODO: 로그 남기기, 재시도 플래그 저장 등
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
                // TODO: 로그/재시도
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
                // TODO: 로그/재시도
                e.printStackTrace();
            }
        });
    }
}
