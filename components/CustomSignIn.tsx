'use client';

import { useState, useEffect } from 'react';
import { useSignIn, useSignUp, SignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function CustomSignIn() {
    const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
    const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
    const router = useRouter();
    const [attemptingSignUp, setAttemptingSignUp] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Set up a listener for the sign-in attempt
    useEffect(() => {
        if (!isSignInLoaded || !signIn) return;

        // Listen for the attempt-failed event
        const handleAttemptFailed = async (attemptData: any) => {
            console.log('Sign-in attempt failed:', attemptData);

            // Check if error is related to user not found
            const isUserNotFoundError = attemptData.reason?.includes('user not found') ||
                attemptData.reason?.includes('identifier or password');

            if (isUserNotFoundError && isSignUpLoaded && attemptData.identifier && attemptData.password) {
                setErrorMessage('');
                setAttemptingSignUp(true);

                try {
                    // Create a new account with the same credentials
                    const emailAddress = attemptData.identifier;
                    const password = attemptData.password;

                    const signUpResult = await signUp.create({
                        emailAddress,
                        password,
                    });

                    // Complete sign-up
                    if (signUpResult.status === 'complete') {
                        await setActive({ session: signUpResult.createdSessionId });
                        router.push('/');
                    } else {
                        // Handle incomplete sign-up, e.g., email verification required
                        if (signUpResult.status === 'needs_first_factor') {
                            await signUpResult.prepareVerification({
                                strategy: 'email_code',
                            });

                            // Redirect to verify page if needed
                            if (signUp.verifications.emailAddress.status === 'needs_verification') {
                                router.push('/sign-up/verify');
                            }
                        }
                    }
                } catch (signUpError: any) {
                    console.error('Auto sign-up error:', signUpError);
                    setAttemptingSignUp(false);

                    // Display the error message
                    if (signUpError.errors && signUpError.errors.length > 0) {
                        setErrorMessage(signUpError.errors[0].message || 'Error creating account');
                    } else {
                        setErrorMessage('Unable to create account automatically');
                    }
                }
            }
        };

        // Get the client object from the signIn instance
        const client = signIn.client;

        // Add the event listener
        if (client && client.addListener) {
            client.addListener('signIn.attemptFailed', handleAttemptFailed);

            // Clean up the listener when the component unmounts
            return () => {
                client.removeListener('signIn.attemptFailed', handleAttemptFailed);
            };
        }
    }, [isSignInLoaded, isSignUpLoaded, signIn, signUp, setActive, router]);

    return (
        <div>
            {attemptingSignUp ? (
                <div className="text-center mb-4">
                    <p className="text-green-600 font-medium">Creating a new account with your credentials...</p>
                </div>
            ) : null}

            {errorMessage ? (
                <div className="text-center mb-4">
                    <p className="text-red-600">{errorMessage}</p>
                </div>
            ) : null}

            <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
            />
        </div>
    );
} 