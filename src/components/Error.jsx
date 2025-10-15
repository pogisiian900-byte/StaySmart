import React from 'react'
import { useNavigate } from 'react-router-dom'
const Error = () => {
    const navigate = useNavigate();
  return (
    <div className="error-contatiner">

        <div className='errorMessage'> 
            <h1>404</h1>
            <h2>Page not Found</h2>
            <p>The resource requested count not be found on this server!</p>
            <button onClick={()=> navigate('/')}>Go to back to Home Page.</button>
        </div>
    </div>
  )
}

export default Error