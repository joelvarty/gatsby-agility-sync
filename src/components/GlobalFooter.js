import React, { Component } from 'react';
import { graphql, StaticQuery } from "gatsby"

import './GlobalFooter.css'

export default props => (
	<StaticQuery
		query={graphql`
        query GlobalFooterQuery {
            agilityGlobalFooter(properties: {referenceName: {eq: "globalfooter"}}) {
                agilityFields {
                footerText
                }
            }
          }
        `}
		render={queryData => {
			const viewModel = {
				item: queryData.agilityGlobalFooter
			}
			return (
				<GlobalFooter {...viewModel} />
			);
		}}
	/>
)

class GlobalFooter extends Component {
	renderFooter = () => {
		console.log("footer", this.props)
		if (this.props.item.agilityFields.footerText) {
			return <div dangerouslySetInnerHTML={{ __html: this.props.item.agilityFields.footerText }}></div>
		}
	}
	render() {

		return (
			<footer className="footer">
				<div className="container">
					{this.renderFooter()}
				</div>
			</footer>
		);
	}
}


