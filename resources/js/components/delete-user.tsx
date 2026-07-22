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
                <h4 className="text-sm font-bold text-slate-900 ">
                    Danger zone
                </h4>
                <p className="mt-1 text-xs text-slate-500 ">
                    Deactivate your account. Your data will be retained for
                    admin recovery.
                </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/60 p-4  ">
                <div className="min-w-0 space-y-0.5 text-slate-700 ">
                    <p className="text-sm font-semibold text-red-950 ">
                        Deactivate account
                    </p>
                    <p className="text-xs leading-relaxed text-red-800/75 ">
                        You will be signed out and the account will no longer be
                        active.
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <button
                            className="shrink-0 cursor-pointer rounded-lg border border-red-600 bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-95"
                            data-test="delete-user-button"
                        >
                            Deactivate account
                        </button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>
                            Are you sure you want to deactivate your account?
                        </DialogTitle>
                        <DialogDescription>
                            Your account will be deactivated and you will be
                            signed out. Your data is retained and can be
                            recovered by an admin. Please enter your password to
                            confirm this action.
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
                                            Password
                                        </Label>

                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            ref={passwordInput}
                                            placeholder="Password"
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
                                                Cancel
                                            </Button>
                                        </DialogClose>

                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="cursor-pointer rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-95 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                                            data-test="confirm-delete-user-button"
                                        >
                                            Deactivate account
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
