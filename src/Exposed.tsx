import * as developmentLibrary from '@repro/development-library';
import * as reactRedux from 'react-redux';

import { store } from './store';

export default function Exposed() {
  return <aside data-loaded={Boolean(store && developmentLibrary && reactRedux)}>Exposed component</aside>;
}
