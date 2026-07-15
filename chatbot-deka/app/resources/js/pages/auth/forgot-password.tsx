// Components
import { Form, Head } from '@inertiajs/react';
import { LoaderCircle, Mail } from 'lucide-react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({ status }: { status?: string }) {
    return (
        <>
            <Head title="Lupa Password" />

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}

            <div className="space-y-6">
                <Form {...email.form()}>
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label
                                    htmlFor="email"
                                    className="mb-1.5 text-xs font-bold tracking-wider text-zinc-500 uppercase"
                                >
                                    Alamat Email
                                </Label>
                                <div className="relative flex items-center">
                                    <Mail className="pointer-events-none absolute left-4 h-5 w-5 text-zinc-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        autoComplete="off"
                                        autoFocus
                                        placeholder="nama@email.com"
                                        className="h-12 w-full rounded-xl border-zinc-200 bg-white pl-11 text-black shadow-sm transition-all placeholder:text-zinc-400 focus:shadow-md focus-visible:border-[#2f80ed] focus-visible:ring-[#2f80ed]/25"
                                    />
                                </div>

                                <InputError message={errors.email} />
                            </div>

                            <div className="my-6 flex items-center justify-start">
                                <Button
                                    className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border-none bg-gradient-to-r from-[#2f80ed] to-[#1a73e8] text-sm font-semibold tracking-wide text-white shadow-md transition-all hover:from-[#1a73e8] hover:to-[#155fc4] hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.99]"
                                    disabled={processing}
                                    data-test="email-password-reset-link-button"
                                >
                                    {processing && (
                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-white" />
                                    )}
                                    Kirim Link Reset Password
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <div className="space-x-1 text-center text-sm font-medium text-zinc-600">
                    <span>Atau kembali ke halaman</span>
                    <TextLink
                        href={login()}
                        className="font-semibold text-[#2f80ed] hover:underline"
                    >
                        Masuk
                    </TextLink>
                </div>
            </div>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Lupa password',
    description: 'Masukkan email Anda untuk menerima tautan reset password',
};
