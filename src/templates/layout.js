import React from "react"
import './layout.css'

export default ({ children }) => {
	return (
		<section className="section">
			<div className="container">
				{children}
			</div>

		</section>
	)
}

