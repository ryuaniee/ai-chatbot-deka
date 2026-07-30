import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const publicDevServerUrl = env.VITE_DEV_SERVER_URL
        ? new URL(env.VITE_DEV_SERVER_URL)
        : null;
    const localDevServerUrl = 'http://localhost:5173';

    return {
        server: {
            host: publicDevServerUrl ? '0.0.0.0' : '127.0.0.1',
            origin: publicDevServerUrl?.origin ?? localDevServerUrl,
            allowedHosts: publicDevServerUrl
                ? [publicDevServerUrl.hostname]
                : [],
            cors: {
                origin: [
                    publicDevServerUrl?.origin,
                    env.APP_URL,
                    /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
                ].filter(Boolean),
            },
            hmr: publicDevServerUrl
                ? {
                      host: publicDevServerUrl.hostname,
                      protocol:
                          publicDevServerUrl.protocol === 'https:'
                              ? 'wss'
                              : 'ws',
                      clientPort:
                          Number(publicDevServerUrl.port) ||
                          (publicDevServerUrl.protocol === 'https:' ? 443 : 80),
                  }
                : {
                      host: 'localhost',
                      protocol: 'ws',
                      clientPort: 5173,
                  },
        },
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.tsx'],
                refresh: true,
                fonts: [
                    bunny('Inter', {
                        weights: [400, 500, 600, 700],
                    }),
                ],
            }),
            inertia(),
            react({
                babel: {
                    plugins: ['babel-plugin-react-compiler'],
                },
            }),
            tailwindcss(),
            wayfinder({
                formVariants: true,
            }),
        ],
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules/@radix-ui')) {
                            return 'vendor-ui';
                        }

                        if (id.includes('node_modules/lucide-react')) {
                            return 'vendor-icons';
                        }
                    },
                },
            },
        },
    };
});
