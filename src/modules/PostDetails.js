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
                        <h1>{post.agilityFields.title}</h1>
                        {post.agilityFields.image &&
                            <img src={post.agilityFields.image.url + '?w=860'} alt="" />
                        }

                        <div><span className="author">{post.agilityFields.author.item.agilityFields.name}</span> | {post.agilityFields.category.item.agilityFields.title}</div>
                        <hr />
                        <div className="post-content" dangerouslySetInnerHTML={this.renderPostContent(post.agilityFields.details)}></div>
                    </div>
                </div>
            </section>
        );
    }
}

export default PostDetails;
