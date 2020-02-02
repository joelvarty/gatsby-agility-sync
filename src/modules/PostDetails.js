import React, { Component } from 'react';

import './PostDetails.css'

class PostDetails extends Component {

	renderPostContent(html) {
		return { __html: html };
	}

	render() {

		const post = this.props.dynamicPageItem;
		return (
			<section className="post-details">
				<div className="container">
					<div className="post">
						<h1>{post.fields.title}</h1>
						{post.fields.image &&
							<img src={post.fields.image.url + '?w=860'} alt="" />
						}

						<div><span className="author">{post.fields.author.fields.name}</span> | {post.fields.category.fields.title}</div>
						<hr />
						<div className="post-content" dangerouslySetInnerHTML={this.renderPostContent(post.fields.details)}></div>
					</div>
				</div>
			</section>
		);
	}
}

export default PostDetails;
