package org.dallyeo.matuabom.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.dallyeo.matuabom.service.GoogleOAuthClientService;
import org.dallyeo.matuabom.service.GoogleSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/google")
@RequiredArgsConstructor
public class GoogleWebhookController {

    private final GoogleOAuthClientService googleTokens;
    private final GoogleSyncService googleSyncService;

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(HttpServletRequest request) {
        String channelId  = request.getHeader("X-Goog-Channel-ID");
        String resourceId = request.getHeader("X-Goog-Resource-ID");
        String state      = request.getHeader("X-Goog-Resource-State");
        String token      = request.getHeader("X-Goog-Channel-Token");

        // 기본적으로는 channelId 로 토큰 엔티티 찾기
        log.info("[GoogleWebhook] channelId={}, resourceId={}, token={}", channelId, resourceId, token);
        googleTokens.findByChannelId(channelId).ifPresent(tokens -> {
            // userId 는 엔티티에 저장돼 있음
            String userId = tokens.getUserId();
            // 증분 동기화는 비동기로 처리
            log.info("[GoogleWebhook] runIncrementalSync for userId={}", userId);
            googleSyncService.runIncrementalSync(userId);
        });

        // 구글 입장에서는 2xx 이면 OK라서 204로 응답
        return ResponseEntity.noContent().build();
    }
}
