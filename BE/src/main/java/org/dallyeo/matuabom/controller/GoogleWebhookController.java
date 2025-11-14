package org.dallyeo.matuabom.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.dallyeo.matuabom.service.GoogleCalendarService;
import org.dallyeo.matuabom.service.GoogleOAuthClientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/google")
@RequiredArgsConstructor
public class GoogleWebhookController {

    private final GoogleOAuthClientService googleTokens;
    private final GoogleCalendarService googleCalendarService;

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleGoogleWebhook(HttpServletRequest request) {

        String channelId  = request.getHeader("X-Goog-Channel-ID");
        String resourceId = request.getHeader("X-Goog-Resource-ID");
        String state      = request.getHeader("X-Goog-Resource-State");

        // state: sync, exists, not_exists 등 (필요하면 필터링 가능)

        googleTokens.findByChannelId(channelId).ifPresent(tokens -> {
            try {
                // 변경분만 동기화
                googleCalendarService.incrementalSync(tokens);
                // 변경된 syncToken 저장
                googleTokens.save(tokens);
            } catch (Exception e) {
                // TODO: log.warn("webhook sync failed", e);
            }
        });

        return ResponseEntity.ok().build();
    }
}
