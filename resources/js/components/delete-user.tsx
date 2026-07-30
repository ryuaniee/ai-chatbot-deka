import { Form } from '@inertiajs/react';
import { useRef } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function DeleteUser() {
    const passwordInput = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-3">
            <div>
                <h4 className="text-sm font-bold text-slate-900">
                    Zona berisiko
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                    Hapus akun secara permanen dan keluar dari aplikasi.
                </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                <div className="min-w-0 space-y-0.5 text-slate-700">
                    <p className="text-sm font-semibold text-red-950">
                        Hapus akun
                    </p>
                    <p className="text-xs leading-relaxed text-red-800/75">
                        Akun dan data chat akan dihapus permanen.
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <button
                            className="shrink-0 cursor-pointer rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 active:scale-95"
                            data-test="delete-user-button"
                        >
                            Hapus
                        </button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>Yakin ingin menghapus akun?</DialogTitle>
                        <DialogDescription>
                            Tindakan ini menghapus akun dan data chat secara
                            permanen. Masukkan kata sandi untuk konfirmasi.
                        </DialogDescription>

                        <Form
                            {...ProfileController.destroy.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            onError={() => passwordInput.current?.focus()}
                            resetOnSuccess
                            className="space-y-6"
                        >
                            {({ resetAndClearErrors, processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor="password"
                                            className="sr-only"
                                        >
                                            Kata sandi
                                        </Label>

                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            ref={passwordInput}
                                            placeholder="Kata sandi"
                                            autoComplete="current-password"
                                        />

                                        <InputError message={errors.password} />
                                    </div>

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="secondary"
                                                onClick={() =>
                                                    resetAndClearErrors()
                                                }
                                            >
                                                Batal
                                            </Button>
                                        </DialogClose>

                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="cursor-pointer rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-95 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                                            data-test="confirm-delete-user-button"
                                        >
                                            Hapus akun
                                        </button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
