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
                                <Label htmlFor="email" className="text-xs font-bold text-zinc-500 tracking-wider uppercase mb-1.5">
                                    Alamat Email
                                </Label>
                                <div className="relative flex items-center">
                                    <Mail className="absolute left-4 text-zinc-400 h-5 w-5 pointer-events-none" />
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        autoComplete="off"
                                        autoFocus
                                        placeholder="nama@email.com"
                                        className="h-12 pl-11 w-full border-zinc-200 rounded-xl text-black bg-white focus-visible:ring-[#2f80ed]/25 focus-visible:border-[#2f80ed] placeholder:text-zinc-400 shadow-sm transition-all focus:shadow-md"
                                    />
                                </div>

                                <InputError message={errors.email} />
                            </div>

                            <div className="my-6 flex items-center justify-start">
                                <Button
                                    className="w-full h-12 bg-gradient-to-r from-[#2f80ed] to-[#1a73e8] hover:from-[#1a73e8] hover:to-[#155fc4] text-white font-semibold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center shadow-md hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.99] text-sm tracking-wide"
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

                <div className="space-x-1 text-center text-sm text-zinc-600 font-medium">
                    <span>Atau kembali ke halaman</span>
                    <TextLink href={login()} className="text-[#2f80ed] font-semibold hover:underline">Masuk</TextLink>
                </div>
            </div>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Lupa password',
    description: 'Masukkan email Anda untuk menerima tautan reset password',
};
