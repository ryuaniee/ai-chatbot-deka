// Components
import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { logout } from '@/routes';

export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <>
            <Head title="Verifikasi email" />

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    Link verifikasi baru telah dikirim ke alamat email Anda.
                </div>
            )}

            <Form
                action="/email/verification-notification-resend"
                method="post"
                className="space-y-6 text-center"
            >
                {({ processing, errors }) => (
                    <>
                        <InputError
                            message={errors.verification}
                            className="text-center"
                        />

                        <Button disabled={processing} variant="secondary">
                            {processing && <Spinner />}
                            Kirim ulang email verifikasi
                        </Button>

                        <TextLink
                            href={logout()}
                            className="mx-auto block text-sm"
                        >
                            Keluar
                        </TextLink>
                    </>
                )}
            </Form>
        </>
    );
}

VerifyEmail.layout = {
    title: 'Verifikasi email',
    description:
        'Silakan verifikasi alamat email Anda melalui tautan yang telah kami kirimkan.',
};
