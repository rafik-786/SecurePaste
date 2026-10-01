import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { webCryptoAvailable } from '../../lib/platform';
import { fragmentOf } from '../paste/linkChecks';
import { UnsupportedStatus } from '../shared/UnsupportedStatus';
import { PasteReader } from './PasteReader';
import { readLinkCheck } from './readState';
import { LinkProblemStatus } from './ReadStatus';

function ReadLink({ id }: { readonly id: string }) {
  const { hash } = useLocation();
  const [fragmentKey] = useState(() => fragmentOf(hash));

  const check = readLinkCheck(id, fragmentKey, webCryptoAvailable());
  switch (check) {
    case 'unsupported':
      return <UnsupportedStatus />;
    case 'invalid-id':
    case 'incomplete':
      return <LinkProblemStatus problem={check} />;
    case 'ready':
      return <PasteReader id={id} fragmentKey={fragmentKey} />;
  }
}

export function ReadRoute() {
  const { id = '' } = useParams();
  return <ReadLink key={id} id={id} />;
}
