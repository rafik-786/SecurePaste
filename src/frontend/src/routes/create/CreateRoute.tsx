import { useState } from 'react';
import { PageHeading } from '../../components/PageHeading';
import { useIsInitialPageLoad } from '../../hooks/navigationFocus';
import { hasFinePointer, webCryptoAvailable } from '../../lib/platform';
import { UnsupportedStatus } from '../shared/UnsupportedStatus';
import { CreateForm } from './CreateForm';
import { DEFAULT_OPTIONS, type CreateOptions } from './formOptions';
import { CreateResult } from './CreateResult';
import type { CreatedPaste } from './links';

function CreatePage({ focusContentOnLoad }: { readonly focusContentOnLoad: boolean }) {
  const [options, setOptions] = useState<CreateOptions>(DEFAULT_OPTIONS);
  const [created, setCreated] = useState<CreatedPaste | undefined>(undefined);
  const [focusContent, setFocusContent] = useState(focusContentOnLoad);

  return (
    <>
      <PageHeading focusOnTextChange={false}>{created ? 'Link created' : 'New paste'}</PageHeading>
      {created ? (
        <CreateResult
          paste={created}
          onCreateAnother={() => {
            setCreated(undefined);
            setFocusContent(true);
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
    </>
  );
}

export function CreateRoute() {
  const initialPageLoad = useIsInitialPageLoad();
  const [supported] = useState(webCryptoAvailable);
  const [focusContentOnLoad] = useState(() => initialPageLoad && hasFinePointer());

  return supported ? <CreatePage focusContentOnLoad={focusContentOnLoad} /> : <UnsupportedStatus />;
}
