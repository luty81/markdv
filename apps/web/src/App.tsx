import {isMarkdown} from '@markdv/core';

export default function App() {
	return (
		<main
			style={{
				fontFamily: 'system-ui, sans-serif',
				maxWidth: 720,
				margin: '4rem auto',
				padding: '0 1.5rem',
				lineHeight: 1.55,
			}}
		>
			<h1 style={{marginBottom: '0.25rem'}}>markdv</h1>
			<p style={{color: '#666', marginTop: 0}}>web · coming soon</p>
			<p>
				This is a stub. The core wiring works:{' '}
				<code>isMarkdown('notes.md')</code> ={' '}
				<strong>{String(isMarkdown('notes.md'))}</strong>.
			</p>
		</main>
	);
}
