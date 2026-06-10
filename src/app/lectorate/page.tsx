import LectorateClient from './LectorateClient'

export const metadata = {
  title: 'Lectorate | Noah Shaw',
  description:
    'Who can actually read your writing? A locally-trained model estimates the share of US and world adults who could comprehend any text — running entirely in your browser.',
}

export default function LectoratePage() {
  return <LectorateClient />
}
