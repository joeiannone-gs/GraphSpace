"use client"

import dynamic from 'next/dynamic';

import store from './store/store'
import { Provider } from 'react-redux'



const Manager = dynamic(
  () => import('@/app/components/Manager/Manager'),
  { ssr: false }  // This will load the component only on client side.
);


export default function App() {


 

  return (
    <main  >
      <Provider store={store}>
        <Manager  />
      </Provider>
    </main>
  )
}

