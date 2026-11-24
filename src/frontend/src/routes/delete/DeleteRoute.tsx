import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { fragmentOf } from '../shared/linkChecks';
import { deleteLinkCheck } from './deleteState';
import { DeleteLinkProblemStatus } from './DeleteStatus';
import { PasteDeleter } from './PasteDeleter';

function DeleteLink({ id }: { readonly id: string }) {
  const { hash } = useLocation();
  const [deleteToken] = useState(() => fragmentOf(hash));

  const check = deleteLinkCheck(id, deleteToken);
  switch (check) {
    case 'invalid-id':
    case 'incomplete':
      return <DeleteLinkProblemStatus problem={check} />;
    case 'ready':
      return <PasteDeleter id={id} deleteToken={deleteToken} />;
  }
}

export function DeleteRoute() {
  const { id = '' } = useParams();
  return <DeleteLink key={id} id={id} />;
}
