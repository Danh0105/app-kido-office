importScripts(
    'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js'
);

importScripts(
    'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js'
);

// File trong `public` không được Vite thay thế import.meta.env. Ứng dụng gửi
// cấu hình vào query string khi đăng ký worker để cùng một bản build hoạt động
// đúng với từng môi trường (development/production).
const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
};

// Một số máy còn registration cũ với URL trần (không có query string). Khi
// trình duyệt tự đánh thức registration đó, ném lỗi ở global scope sẽ khiến
// worker liên tục báo đỏ và không thể được bản mới thay thế sạch sẽ. Chỉ bốn
// giá trị dưới đây là bắt buộc cho Firebase Messaging; authDomain và
// storageBucket không tham gia cấp FCM token.
const requiredConfigKeys = [
    'apiKey',
    'projectId',
    'messagingSenderId',
    'appId',
];
const hasMessagingConfig = requiredConfigKeys.every(
    (key) => firebaseConfig[key],
);

if (hasMessagingConfig) {
    firebase.initializeApp(firebaseConfig);

    const messaging = firebase.messaging();

    // BACKGROUND PUSH
    messaging.onBackgroundMessage(
        (payload) => {
            console.log(
                '📩 Background:',
                payload,
            );

            const title =
                payload.data?.title ||
                'Thông báo';

            const options = {
                body:
                    payload.data?.body || '',

                icon: '/pwa-192x192.png',

                badge: '/pwa-192x192.png',

                tag:
                    payload.data?.id ||
                    Date.now().toString(),

                renotify: true,

                data: payload.data,
            };

            self.registration.showNotification(
                title,
                options,
            );
        },
    );
} else {
    // Không throw: initWebPush sẽ đăng ký lại cùng scope bằng URL có config.
    console.warn(
        'Firebase messaging worker is waiting for app configuration.',
    );
}

// CLICK NOTIFICATION
self.addEventListener(
    'notificationclick',
    (event) => {
        event.notification.close();

        const rawUrl = event.notification.data?.url || '/';
        // URL tương đối cần được neo theo origin của ứng dụng, không theo scope
        // riêng của Firebase worker.
        const url = new URL(rawUrl, self.location.origin).href;

        console.log(
            'CLICK URL:',
            url,
        );

        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            }).then(
                (clientList) => {
                    // app đang mở
                    for (const client of clientList) {
                        if (
                            client.url.includes(
                                self.location.origin,
                            ) &&
                            'focus' in client
                        ) {
                            client.navigate(
                                url,
                            );

                            return client.focus();
                        }
                    }

                    // app chưa mở
                    if (
                        clients.openWindow
                    ) {
                        return clients.openWindow(
                            url,
                        );
                    }
                },
            ),
        );
    },
);
