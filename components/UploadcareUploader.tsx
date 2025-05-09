'use client' // is needed only if you're using React Server Components
import { FileUploaderRegular } from '@uploadcare/react-uploader/next';
import '@uploadcare/react-uploader/core.css';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { clear } from 'console';

interface UploadedFile {
    uuid: string;
    fileInfo: {
        originalFilename: string;
        size: number;
        mimeType: string;
    };
    status: string;
    cdnUrl: string;
}

// Define the ref interface with the clearFiles method
interface UploaderRefInterface {
    clearFiles: () => void;
}

const UploadcareUploader = forwardRef<UploaderRefInterface, { onUpload: (url: string) => void }>(({ onUpload }, ref) => {
    const [isClient, setIsClient] = useState(false)
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const ctxProviderRef = useRef(null);

    // Expose the clearFiles method to parent components through ref
    useImperativeHandle(ref, () => ({
        clearFiles: () => {
            setFiles([]);
            // Try to reset the uploader if possible
            if (ctxProviderRef.current) {
                const ctxProvider = ctxProviderRef.current as any;
                if (ctxProvider.api && typeof ctxProvider.api.reset === 'function') {
                    ctxProvider.api.reset();
                }
                // Try to dispatch an event to clear files
                try {
                    ctxProvider.dispatchEvent(new CustomEvent('uploadcare:clear'));
                } catch (e) {
                    console.log('Could not dispatch clear event');
                }
            }
        }
    }));

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        let ctxProvider: any;
        const timeoutId = setTimeout(() => {
            ctxProvider = ctxProviderRef.current;
            if (!ctxProvider) return;
            const handleChangeEvent = (e: any) => {
                console.log('change event payload:', e);
                setFiles([...e.detail.allEntries.filter((f: any) => f.status === 'success')] as any);
                clearTimeout(timeoutId);
            };
            ctxProvider.addEventListener('change', handleChangeEvent);
        }, 5000)

        return () => {
            // clearTimeout(timeoutId);
            if (ctxProvider) {
                ctxProvider.removeEventListener('change', () => { });
            }
        }

    }, [setFiles]);

    useEffect(() => {
        if (files.length > 0) {
            onUpload(files[0].cdnUrl);
        }
    }, [files, onUpload]);

    return (
        <div className='mx-auto'>
            <FileUploaderRegular
                apiRef={ctxProviderRef}
                sourceList="local, camera,  gdrive"
                cameraModes="video"
                classNameUploader="uc-light mx-auto upload-care-btn"
                pubkey={process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY as any}
                multiple={false}
                imgOnly={false}
                accept='video/*'
            />
        </div>
    );
});

UploadcareUploader.displayName = 'UploadcareUploader';

export default UploadcareUploader;