import React, { Component } from 'react';
import { graphql, StaticQuery } from "gatsby"

import './GlobalFooter.css'

export default props => (
	<StaticQuery
		query={graphql`
        query GlobalFooterQuery {
            agilityGlobalFooter(properties: {referenceName: {eq: "globalfooter"}}) {
                customFields {
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

		if (this.props.item.customFields.footerText) {
			return <div dangerouslySetInnerHTML={{ __html: this.props.item.customFields.footerText }}></div>
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


