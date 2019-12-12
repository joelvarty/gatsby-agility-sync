import React from "react"
import './layout.css'

export default ({ children }) => {
	return (
		<section class="section">
			<div class="container">
				{children}
			</div>

		</section>
	)
}

