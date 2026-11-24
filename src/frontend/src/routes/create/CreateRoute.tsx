import { useState } from 'react';
import { Button } from '../../components/Button';
import { PageHeading } from '../../components/PageHeading';
import { useIsInitialPageLoad } from '../../hooks/navigationFocus';
import { hasFinePointer, webCryptoAvailable } from '../../lib/platform';
import { PasteDeletedStatus } from '../shared/PasteDeletedStatus';
import { UnsupportedStatus } from '../shared/UnsupportedStatus';
import { CreateForm } from './CreateForm';
import { DEFAULT_OPTIONS, type CreateOptions } from './formOptions';
import { CreateResult } from './CreateResult';
import type { CreatedPaste } from './links';
import { useForgetOnPageHide } from './useForgetOnPageHide';
import styles from './CreateRoute.module.css';

function CreatePage({ focusContentOnLoad }: { readonly focusContentOnLoad: boolean }) {
  const [options, setOptions] = useState<CreateOptions>(DEFAULT_OPTIONS);
  const [created, setCreated] = useState<CreatedPaste | undefined>(undefined);
  const [deleted, setDeleted] = useState(false);
  const [focusContent, setFocusContent] = useState(focusContentOnLoad);
  useForgetOnPageHide(() => {
    setCreated(undefined);
  });

  const createAnother = () => {
    setCreated(undefined);
    setDeleted(false);
    setFocusContent(true);
  };

  if (deleted) {
    return (
      <PasteDeletedStatus
        action={
          <Button variant="primary" onClick={createAnother}>
            Create another
          </Button>
        }
      />
    );
  }

  return (
    <div className={created ? styles.resultPage : styles.formPage}>
      <PageHeading focusOnTextChange={false}>{created ? 'Link created' : 'New paste'}</PageHeading>
      {created ? (
        <CreateResult
          paste={created}
          onCreateAnother={createAnother}
          onDeleted={() => {
            setCreated(undefined);
            setDeleted(true);
          }}
        />
      ) : (
        <CreateForm
          options={options}
          onOptionsChange={setOptions}
          onCreated={setCreated}
          focusContentOnMount={focusContent}
        />
      )}
    </div>
  );
}

export function CreateRoute() {
  const initialPageLoad = useIsInitialPageLoad();
  const [supported] = useState(webCryptoAvailable);
  const [focusContentOnLoad] = useState(() => initialPageLoad && hasFinePointer());

  return supported ? <CreatePage focusContentOnLoad={focusContentOnLoad} /> : <UnsupportedStatus />;
}
